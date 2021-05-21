# Imports
from firebase_admin import credentials, firestore, initialize_app, db
from glob import glob
from graph_tool import Graph
from graph_tool.draw import sfdp_layout
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time


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
            # This will read in each file, deleting the information we don't need from it in the process
            contents = json_file.read()
            pblock = json.loads(contents)
            # Extract and temporarily store info
            timestamp = pblock["scheduled_time"]
            previous_state_hash = pblock["protocol_state"]["previous_state_hash"]
            creator = pblock["protocol_state"]["body"]["consensus_state"]["block_creator"]
            height = pblock["protocol_state"]["body"]["consensus_state"]["global_slot_since_genesis"]
            charged = pblock["protocol_state"]["body"]["consensus_state"]["supercharge_coinbase"]
            # Strip all info
            pblock.clear()
            # Re-add information and store to our 'parsed' dict
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
    # We instantiate our graph mapping within this method, since it's the method for populating it as well.
    g = Graph()
    vertices = {}
    g.vertex_properties["vertex_hash"] = g.new_vertex_property('string')
    g.vertex_properties["vertex_canon"] = g.new_vertex_property('bool')
    g.vertex_properties["vertex_color"] = g.new_vertex_property('vector<double>')

    # Iterate through parsed blocks and add each one to the graph_tools graph as a vertex
    for state_hash in __builtins__.list(input_blocks.keys()):
        map_block = input_blocks[state_hash]
        previous_state_hash = map_block["protocol_state"]["previous_state_hash"]
        if state_hash not in vertices:
            vertices[state_hash] = g.add_vertex()
            # Store the block hash within the vertex_hash property for later use
            g.vertex_properties["vertex_hash"][vertices[state_hash]] = state_hash
        if previous_state_hash not in vertices:
            vertices[previous_state_hash] = g.add_vertex()
            # Store block hash as above for previous block
            g.vertex_properties["vertex_hash"][vertices[previous_state_hash]] = previous_state_hash
        g.add_edge(vertices[state_hash], vertices[previous_state_hash])
    sfdp_layout(g, p=4)

    # Because we create several variables that other functions need access to here, return them all as a tuple
    return g


# Step through the graph representation of blocks to determine the canonical "head" of the blockchain.
# Requires the blockchain to be mapped with the blockmap() function.
def canon(input_blocks, g):
    # Iterate through the blockchain and check each block's block height to find the "highest" one, which is canon
    def heightCompare(blockList):
        chainResult = ('', 0)
        longest = 0
        for index, hblock in enumerate(blockList):
            length = int(
                input_blocks[g.vertex_properties["vertex_hash"][hblock]]["protocol_state"]["body"]["consensus_state"][
                    "global_slot_since_genesis"])
            if length > longest:
                longest = length
                chainResult = (g.vertex_properties["vertex_hash"][hblock], hblock)
        return chainResult

    in_degrees = g.get_in_degrees(g.get_vertices())
    endpoints = set()
    # For each of our in-degrees, add to endpoints if there are no other blocks that have it as their previous block
    for cvertex, in_degree in enumerate(in_degrees):
        if in_degree == 0:
            endpoints.add(cvertex)
    return heightCompare(endpoints), endpoints


# Loop used by the paint() function to mark nodes as canonical, using a starting known canonical block.
# This probably shouldn't be called ever outside of its usage in the paint() function
def colorCrawl(canonNode, g):
    node = g.vertex(canonNode)
    g.vertex_properties["vertex_canon"][node] = True
    for _ in g.get_vertices():
        # Exit this loop early once we reach the end of the canonical chain
        if node.out_degree() == 0:
            return 0
        # Set our working node to the next neighbor in line
        for neighbor in node.out_neighbors():
            node = g.vertex(neighbor)
        # Set our node as canon
        g.vertex_properties["vertex_canon"][node] = True


# "Paints" nodes on the map depending on their canonical status. This includes both literal color and a bool flag.
# Requires the canonical "head" of the blockchain to be found using the canon() function.
def paint(input_canon, g):
    # Mark every node as non-canon initially
    for v in g.vertices():
        g.vertex_properties["vertex_canon"][v] = False
    # Mark canon nodes as canon
    colorCrawl(input_canon[1], g)


# Processes the entire blockchain using its graph representation to build a collection of all known forks.
# Requires the blockchain's force-directed graph representation to be painted with the paint() function.
def fork_process(endpoints, g):
    forks = []

    # For each fork, add each block to an array, and continue adding until our fork returns to the canonical chain
    # This array of forked blocks is then added back to our main 'fork' array
    def forkCrawl(fblock, fcontainer):
        node = g.vertex(fblock)
        if g.vertex_properties["vertex_canon"][node]:
            forks.append(fcontainer)
            return 0
        else:
            fcontainer.append(g.vertex_properties["vertex_hash"][node])
            for neighbor in node.out_neighbors():
                return forkCrawl(neighbor, fcontainer)

    # Loop to crawl through every endpoint (fork head) and build an array of forks
    for vertex in endpoints:
        container = []
        forkCrawl(vertex, container)
    return forks


# Prepares the fork data to be received properly by the FireBase database.
# Requires creating a collection of forks using the fork_process() function.
def stage(forks, blocks):
    # 'staging' is JSON data which will contain a new "snapshot" of the firebase database for upload
    staging = {}
    for fork in forks:
        # 'staged_fork' contains all data for a given fork
        staged_fork = {"length": len(fork), "blocks": {"block": [], "creator": []}, "creators": [], "rewards": 0,
                       "latest": '', "last_updated": 0}
        initialized = False
        fork_root = ""
        for block in fork:
            # Blocks in fork inserted such that oldest block is at index 0
            staged_fork["blocks"]["block"].insert(0, block)
            staged_fork["blocks"]["creator"].insert(0, blocks[block]["protocol_state"]["body"]["consensus_state"][
                "block_creator"])
            # Set local variable to the oldest block hash for use later in creating unique ID hash
            if not initialized:
                fork_root = block
                initialized = True
            # Add 1440 mina to "lost rewards" if the block is supercharged, otherwise 720
            if blocks[block]["protocol_state"]["body"]["consensus_state"]["supercharge_coinbase"]:
                staged_fork["rewards"] += 1440
            else:
                staged_fork["rewards"] += 720
            # Update the 'latest' and 'last_updated' fields according to our most recent block
            if int(blocks[block]["scheduled_time"]) > int(staged_fork["last_updated"]):
                staged_fork["last_updated"] = int(blocks[block]["scheduled_time"])
                staged_fork["latest"] = [block][0]
        # Unique ID is MD5 generated from the timestamp of the first block in the fork combined with its state hash
        if fork_root != '':
            fork_combo = fork_root + blocks[fork_root]["scheduled_time"] + \
                         blocks[fork_root]["protocol_state"]["body"]["consensus_state"]["block_creator"]
            fork_hash = hashlib.md5(fork_combo.encode("utf-8")).hexdigest()
            staging[fork_hash] = staged_fork
    return staging


# Pushes changes to a FireBase database.
# Requires valid data to be contained within its input parameters - this can be obtained using the stage() function.
def firebase_update(staging):
    # Set up firebase environment
    environment = os.environ.get("ENV", "DEV")
    url = os.environ.get("DB_URL", "https://sv-mina-forks-default-rtdb.firebaseio.com/")
    int(os.environ.get("PORT", 8080))

    if environment == "DEV":
        cred = credentials.Certificate('service_account.json')
        initialize_app(cred, options={'databaseURL': url})
    else:
        initialize_app(options={'databaseURL': url})
    firestore.client()

    # Overwrite the entire 'forks' database section with data
    db_json = db.reference("forks")
    db_json.set(staging)


# Reset everything and run from the top, optionally with printouts based on boolean parameter.
def powercycle(printout=False):
    # Download Blocks
    start = time.time()
    files = download()
    end = time.time()
    if printout:
        print(f"{len(files)} Blocks Synchronized in {end - start} seconds")

    # Parse Blocks
    start = time.time()
    blocks = parse(files)
    end = time.time()
    if printout:
        print(f"Parsed {len(blocks.keys())} Blocks in {end - start} seconds.")

    # Map Blocks
    start = time.time()
    g = blockmap(blocks)
    end = time.time()
    if printout:
        print(f"Mapped all blocks in {end - start} seconds.")

    # Determine canonical head and endpoints
    start = time.time()
    canonical, endpoints = canon(blocks, g)
    end = time.time()
    if printout:
        print(f"Found canonical chain using blockchain data at Node {canonical[1]} in {end - start} seconds.")

    # Determine canonical status of entire blockchain using canonical head information
    start = time.time()
    paint(canonical, g)
    end = time.time()
    if printout:
        print(f"Recursively painted canonical chain in {end - start} seconds.")

    # Sort forked blocks into arrays of unique forks
    forks = fork_process(endpoints, g)
    if printout:
        print(f"Processed {len(forks)} forks.")

    # Place forks into JSON data for upload
    staging = stage(forks, blocks)
    if printout:
        print(f"Staged {len(staging)} forks for upload.")
    start = time.time()

    # Upload to firebase database
    firebase_update(staging)
    end = time.time()
    if printout:
        print(f"Synchronized {len(staging)} total forks with the FireBase database in {end - start} seconds.")


if __name__ == '__main__':
    powercycle(printout=True)
