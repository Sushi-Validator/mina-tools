# Imports
from firebase_admin import credentials, firestore, initialize_app, db
from glob import glob
from graph_tool import Graph
from graph_tool.draw import sfdp_layout
import json
import os
from pathlib import Path
import subprocess
import sys
import time

# GLOBALS
blue = (0, 0, 1, 1)
red = (1, 0, 0, 1)
green = (0, 1, 0, 1)
endpoints = set()
shame = []
g = Graph()
vertices = {}
vertex_hash = g.new_vertex_property('string')
vertex_canon = g.new_vertex_property('bool')
vertex_color = g.new_vertex_property('vector<double>')
g.vertex_properties['vertex_canon'] = vertex_canon
g.vertex_properties['vertex_color'] = vertex_color


# Each of the functions below can be called independently, but some rely on data from each other to function properly.
# For normal usage, just run the 'powercycle()' function, and it'll take care of the sequencing for you.
# Feel free to call these out of order for specific/specialized tasks, but don't yell at me if something breaks :)

# Synchronize local block collection with Google Cloud bucket, then return the synchronized file listing.
def download():
    Path(os.environ.get('OUTPUT_DIR', "mina_mainnet_blocks")).mkdir(parents=True, exist_ok=True)
    command = f"gsutil -m rsync -r gs://{os.environ.get('BUCKET_NAME', 'mina_mainnet_blocks')} " \
              f"{os.environ.get('OUTPUT_DIR', 'mina_mainnet_blocks')}"
    print(f"Running command: {command}")
    subprocess.run(command.split(), stdout=subprocess.PIPE, text=True)
    return glob(os.environ.get('OUTPUT_DIR', "mina_mainnet_blocks") + "/*")


# Prune unnecessary data from blocks and organize them into a collection, then return said collection of blocks.
# Requires a file listing to iterate through; one can be created with the download() function.
def parse(block_file_list):
    parsed = {}
    for file in block_file_list:
        state_hash = file.split("-")[1].split(".")[0]
        with open(file, "r", encoding="ISO-8859-1") as json_file:
            contents = json_file.read()
            pblock = json.loads(contents)
            timestamp = pblock["scheduled_time"]
            previous_state_hash = pblock["protocol_state"]["previous_state_hash"]
            creator = pblock["protocol_state"]["body"]["consensus_state"]["block_creator"]
            height = pblock["protocol_state"]["body"]["consensus_state"]["global_slot_since_genesis"]
            charged = pblock["protocol_state"]["body"]["consensus_state"]["supercharge_coinbase"]
            pblock.clear()
            pblock["protocol_state"] = {}
            pblock["protocol_state"]["body"] = {}
            pblock["protocol_state"]["body"]["consensus_state"] = {}
            pblock["scheduled_time"] = timestamp
            pblock["protocol_state"]["previous_state_hash"] = previous_state_hash
            pblock["protocol_state"]["body"]["consensus_state"]["block_creator"] = creator
            pblock["protocol_state"]["body"]["consensus_state"]["global_slot_since_genesis"] = height
            pblock["protocol_state"]["body"]["consensus_state"]["supercharge_coinbase"] = charged
            parsed[state_hash] = pblock
    return parsed


# Use graphtool to map our blocks into a force-directed graph representation.
# Requires the blocks to be parsed using the parse() function.
def blockmap(input_blocks):
    global g

    g = Graph()
    for state_hash in __builtins__.list(input_blocks.keys()):
        map_block = input_blocks[state_hash]
        previous_state_hash = map_block["protocol_state"]["previous_state_hash"]
        if state_hash not in vertices:
            vertices[state_hash] = g.add_vertex()
            vertex_hash[vertices[state_hash]] = state_hash
        if previous_state_hash not in vertices:
            vertices[previous_state_hash] = g.add_vertex()
            vertex_hash[vertices[previous_state_hash]] = previous_state_hash
        g.add_edge(vertices[state_hash], vertices[previous_state_hash])
    sfdp_layout(g, p=4)


# Step through the graph representation of blocks to determine the canonical "head" of the blockchain.
# Requires the blockchain to be mapped with the blockmap() function.
def canon(input_blocks):
    global endpoints

    def heightCompare(blockList):
        chainResult = ('', 0)
        longest = 0
        for index, hblock in enumerate(blockList):
            length = int(
                input_blocks[vertex_hash[hblock]]["protocol_state"]["body"]["consensus_state"][
                    "global_slot_since_genesis"])
            if length > longest:
                longest = length
                chainResult = (vertex_hash[hblock], hblock)
        return chainResult

    in_degrees = g.get_in_degrees(g.get_vertices())
    endpoints = set()
    for cvertex, in_degree in enumerate(in_degrees):
        if in_degree == 0:
            endpoints.add(cvertex)
    return heightCompare(endpoints)


# Recursive crawl used by the paint() function to mark nodes as canonical, using a starting known canonical block.
# This probably shouldn't be called ever outside of its usage in the paint() function
def colorCrawl(index):
    node = g.vertex(index)
    vertex_color[node] = green
    vertex_canon[node] = True
    if sum(1 for _ in node.out_neighbors()) == 0:
        vertex_color[node] = blue
        return 0
    for neighbor in node.out_neighbors():
        return colorCrawl(neighbor)


# "Paints" nodes on the map depending on their canonical status. This includes both literal color and a bool flag.
# Requires the canonical "head" of the blockchain to be found using the canon() function.
def paint(input_canon):
    for v in g.vertices():
        vertex_color[v] = red
        vertex_canon[v] = False

    sys.setrecursionlimit(1000000)
    colorCrawl(input_canon[1])
    sys.setrecursionlimit(1000)


# Processes the entire blockchain using its graph representation to build a collection of all known forks.
# Requires the blockchain's force-directed graph representation to be painted with the paint() function.
def fork_process(input_blocks):
    global shame
    forks = []
    shame = []

    def forkCrawl(fblock, fcontainer):
        node = g.vertex(fblock)
        if vertex_canon[node]:
            forks.append(fcontainer)
            return 0
        else:
            fcontainer.append(vertex_hash[node])
            for neighbor in node.out_neighbors():
                return forkCrawl(neighbor, fcontainer)

    last_week = (int(time.time()) - 604800) * 1000
    for vertex in endpoints:
        container = []
        forkCrawl(vertex, container)
    for pfork in forks:
        for pblock in pfork:
            if int(input_blocks[pblock]["scheduled_time"]) > last_week and len(pfork) > 5:
                shame.append(pfork)
    return forks


# Prepares the fork data to be received properly by the FireBase database.
# Requires creating a collection of forks using the fork_process() function.
def stage(forks, blocks):
    staging = []
    for fork in forks:
        forkdata = {"length": len(fork), "blocks": [], "creators": [], "rewards": 0, "latest": '', "last_updated": 0}
        for block in fork:
            forkdata["blocks"].append(block)
            if blocks[block]["protocol_state"]["body"]["consensus_state"]["block_creator"] not in forkdata["creators"]:
                forkdata["creators"].append(blocks[block]["protocol_state"]["body"]["consensus_state"]["block_creator"])
            if blocks[block]["protocol_state"]["body"]["consensus_state"]["supercharge_coinbase"]:
                forkdata["rewards"] += 1440
            else:
                forkdata["rewards"] += 720
            if int(blocks[block]["scheduled_time"]) > int(forkdata["last_updated"]):
                forkdata["last_updated"] = blocks[block]["scheduled_time"]
                forkdata["latest"] = [block][0]

        staging.append(forkdata)
    return staging


# Pushes changes to a FireBase database.
# Requires valid data to be contained within its input parameters - this can be obtained using the stage() function.
def firebase_update(staging):
    environment = os.environ.get("ENV", "DEV")
    url = os.environ.get("DB_URL", "https://sv-mina-forks-default-rtdb.firebaseio.com/")
    port = int(os.environ.get("PORT", 8080))

    if environment == "DEV":
        cred = credentials.Certificate('service_account.json')
        default_app = initialize_app(cred, options={'databaseURL': url})
    else:
        default_app = initialize_app(options={'databaseURL': url})
    client = firestore.client()

    db_json = db.reference("forks").get()
    if db_json is None:
        for fork in staging:
            db.reference("forks").push(fork)
        db_json = db.reference("forks").get()

    for unique in db_json:
        prune = True
        for fork in staging:
            if db_json[unique]["latest"] == fork["latest"]:
                prune = False
                break
        if prune:
            db.reference("forks").child(unique).delete()

    for fork in staging:
        new_fork = True
        for unique in db_json:
            if fork["latest"] == db_json[unique]["latest"]:
                new_fork = False
                break
        if new_fork:
            db.reference("forks").push(fork)


# Reset everything and run from the top, optionally with printouts based on boolean parameter.
def powercycle(printout=False):
    start = time.time()
    files = download()
    end = time.time()
    if printout:
        print(f"{len(files)} Blocks Synchronized in {end - start} seconds")
    start = time.time()
    blocks = parse(files)
    end = time.time()
    if printout:
        print(f"Parsed {len(blocks.keys())} Blocks in {end - start} seconds.")
    blockmap(blocks)
    start = time.time()
    canonical = canon(blocks)
    end = time.time()
    if printout:
        print(f"Found canonical chain using blockchain data at Node {canonical[1]} in {end - start} seconds.")
    start = time.time()
    paint(canonical)
    end = time.time()
    if printout:
        print(f"Recursively painted canonical chain in {end - start} seconds.")
    forks = fork_process(blocks)
    if printout:
        print(f"Processed {len(forks)} forks total, {len(shame)} of which are from the past week.")
    staging = stage(forks, blocks)
    if printout:
        print(f"Staged {len(forks)} forks for upload.")
    start = time.time()
    firebase_update(staging)
    end = time.time()
    if printout:
        print(f"Synchronized {len(forks)} total forks with the FireBase database in {end - start} seconds.")


if __name__ == '__main__':
    powercycle()
