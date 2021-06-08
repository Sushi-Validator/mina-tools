# Imports
from firebase_admin import credentials, firestore, initialize_app, db
from glob import glob
import hashlib
import json
import os
from pathlib import Path
import pickle
import requests
import subprocess
import time


# Progress bar. Just for visual fluff, can probably be removed.
def progress(iteration, total, prefix='', suffix='', decimals=1, length=100, fill='█', end="\r"):
    percent = ("{0:." + str(decimals) + "f}").format(100 * (iteration / float(total)))
    filled = int(length * iteration // total)
    bar = fill * filled + '-' * (length - filled)
    print(f'\r{prefix} |{bar}| {percent}% {suffix}', end=end)
    if iteration == total:
        print()


# Because I as of yet have not found a sufficient python library for this task, we're making our own classes.
class Block:
    def __init__(self, h='', p='', d=0, t='', c=None):
        self.hash = h
        self.parent = p
        self.child = c
        self.height = d
        self.timestamp = t
        self.canon = False


# Basic structure that holds a dict of Block objects, and is able to perform work on them using the attributes as
# defined in the Block class. Dict is used solely to speed things up, in spite of the mild clunkiness.
class Blockchain:
    def __init__(self):
        self.blocks = {}

    # Adds a new block to the chain. If present, it will find the relevant child and update the block's attribute.
    def add(self, block):
        for unit in self.blocks:
            if block.hash == self.blocks[unit].parent:
                block.child = self.blocks[unit].hash
        self.blocks[block.hash] = block

    # Removes the block from the chain.
    def remove(self, block):
        del self.blocks[block.hash]

    # Returns a set of endpoints. NOT a dict.
    def endpoints(self):
        endpoints = set()
        for block in self.blocks:
            if self.blocks[block].child is None:
                endpoints.add(self.blocks[block])
        return endpoints

    # Returns the highest block in the chain.
    def canonical(self):
        longest = 0
        longest_timestamp = 0
        canonical = ''
        for block in self.blocks:
            if int(self.blocks[block].height) > longest:
                longest = int(self.blocks[block].height)
                longest_timestamp = int(self.blocks[block].timestamp)
                canonical = self.blocks[block]
            else:  # Tiebreaker
                if int(self.blocks[block].height) == longest:
                    if int(self.blocks[block].timestamp) > longest_timestamp:
                        longest = int(self.blocks[block].height)
                        longest_timestamp = int(self.blocks[block].timestamp)
                        canonical = self.blocks[block]
        return canonical

    # Returns a boolean indicating whether or not a given block hash is present within the blockchain.
    def has(self, blockhash):
        if blockhash in self.blocks:
            return True
        else:
            return False

    # Returns a Block object from the blockchain corresponding to the given hash, and None if it is not present.
    def get(self, blockhash):
        if blockhash in self.blocks:
            return self.blocks[blockhash]
        else:
            return None

    # Checks for absent blocks or children and fixes them; this will also update a given master file, if provided.
    # This does NOT implicitly save the changes to file - it's recommended to call save() after using this function.
    # Just don't call this unless you really need to.
    def validate(self, master=None, verbose=True):
        # Counters for report
        missingblocks = 0
        missingchildren = 0
        report = "No errors detected in blockchain."

        # Check for missing blocks
        total = len(self.blocks)
        for i, block in enumerate(list(self.blocks)):
            if self.get(self.blocks[block].parent) is None:
                # Get block data from MinaExplorer, then add it to the blockchain
                response = requests.get(f"https://api.minaexplorer.com/blocks/{self.blocks[block].parent}").json()
                try:
                    # Store block to master, if provided
                    if master:
                        # Isolate the information we want
                        timestamp = response["block"]["protocolState"]["blockchainState"]["date"]
                        previous_state_hash = response["block"]["protocolState"]["previousStateHash"]
                        creator = response["block"]["creator"]
                        height = response["block"]["blockHeight"]
                        if response["block"]["transactions"]["coinbase"] == 720000000000:
                            charged = False
                        else:
                            charged = True
                        # Add relevant information
                        new_block = dict()
                        new_block["protocol_state"]["body"] = {}
                        new_block["protocol_state"]["body"]["consensus_state"] = {}
                        new_block["scheduled_time"] = timestamp
                        new_block["protocol_state"]["previous_state_hash"] = previous_state_hash
                        new_block["protocol_state"]["body"]["consensus_state"]["block_creator"] = creator
                        new_block["protocol_state"]["body"]["consensus_state"]["global_slot_since_genesis"] = height
                        new_block["protocol_state"]["body"]["consensus_state"]["supercharge_coinbase"] = charged
                        master[self.blocks[block].parent] = new_block
                    # Create a new block from the data and add it to the blockchain.
                    response_hash = self.blocks[block].parent
                    response_parent = response["block"]["protocolState"]["previousStateHash"]
                    response_height = response["block"]["blockHeight"]
                    response_timestamp = response["block"]["protocolState"]["blockchainState"]["date"]
                    block = Block(response_hash, response_parent, response_height, response_timestamp)
                    self.add(block)
                    missingblocks += 1
                # If MinaExplorer doesn't have the block, we'll get a KeyError. Should only happen at the genesis block.
                except KeyError:
                    # print(KeyError)  # Debug
                    continue
            if verbose:
                progress(i + 1, total, prefix='Checking for Missing Blocks:', suffix='Complete', length=50)
        if missingblocks:
            report = f"Fixed {missingblocks} missing Blocks"

        # Check for missing children.
        total = len(self.blocks)
        for j, block in enumerate(list(self.blocks)):
            if self.get(self.blocks[block].child) is None:
                for potentialchild in self.blocks:
                    if self.blocks[potentialchild].parent == self.blocks[block].hash:
                        self.blocks[block].child = potentialchild
                        missingchildren += 1
            if verbose:
                progress(j + 1, total, prefix='Checking for Missing Children:', suffix='Complete', length=50)
        if missingchildren:
            if missingblocks:
                report += f" and {missingchildren} missing Children"
            else:
                report = f"Fixed {missingblocks} missing Children"
        return report

    # Pickles the object to a destination of user's choice.
    def save(self, destination):
        pickle.dump(self, open(destination, "wb"))


# Each of the functions below can be called independently, but some rely on data from each other to function properly.
# For normal usage, just run the 'powercycle()' function, and it'll take care of the sequencing for you.
# Feel free to call these out of order for specific/specialized tasks, but don't yell at me if something breaks :)

# Synchronize local block collection with Google Cloud bucket, then return the synchronized file listing.
def download():
    Path(os.environ.get('OUTPUT_DIR', "mina_mainnet_blocks")).mkdir(parents=True, exist_ok=True)
    command = f"gsutil -m rsync -r gs://{os.environ.get('BUCKET_NAME', 'mina_mainnet_blocks')} " \
              f"{os.environ.get('OUTPUT_DIR', 'mina_mainnet_blocks')}"
    print(f"Running command: {command}")
    subprocess.run(command.split(), stdout=subprocess.PIPE, shell=True, text=True)
    return glob(os.environ.get('OUTPUT_DIR', "mina_mainnet_blocks") + "/*")


# Prune unnecessary data from blocks and organize them into a collection, then return said collection of blocks.
# Requires a file listing to iterate through; one can be created with the download() function.
def parse(block_file_list):
    master = os.path.abspath(os.environ.get("MASTER", "master.json"))
    if not Path(master).is_file():
        with open(master, "w", encoding="ISO-8859-1") as new_master:
            new_master.write("{}")
            new_master.close()

    # Parsing involves stripping out all info that we do not need from the block, then storing it back in the master.
    with open(master, "r+", encoding="ISO-8859-1") as master_file:
        contents = master_file.read()
        master_json = json.loads(contents)
        new_files = 0  # This is just to track how many new blocks were parsed in a given run
        for file in block_file_list:
            state_hash = file.split("-")[1].split(".")[0]
            if state_hash in master_json:
                continue
            with open(file, "r", encoding="ISO-8859-1") as json_file:
                # This will read in each file, deleting the information we don't need from it in the process
                contents = json_file.read()
                block = json.loads(contents)
                # Extract and temporarily store info
                timestamp = block["scheduled_time"]
                previous_state_hash = block["protocol_state"]["previous_state_hash"]
                creator = block["protocol_state"]["body"]["consensus_state"]["block_creator"]
                height = block["protocol_state"]["body"]["consensus_state"]["global_slot_since_genesis"]
                charged = block["protocol_state"]["body"]["consensus_state"]["supercharge_coinbase"]
                # Strip all info
                block.clear()
                # Re-add information and store to our 'parsed' dict
                block["protocol_state"] = {}
                block["protocol_state"]["body"] = {}
                block["protocol_state"]["body"]["consensus_state"] = {}
                block["scheduled_time"] = timestamp
                block["protocol_state"]["previous_state_hash"] = previous_state_hash
                block["protocol_state"]["body"]["consensus_state"]["block_creator"] = creator
                block["protocol_state"]["body"]["consensus_state"]["global_slot_since_genesis"] = height
                block["protocol_state"]["body"]["consensus_state"]["supercharge_coinbase"] = charged
                master_json[state_hash] = block
                new_files += 1
        master_file.seek(0)
        master_file.truncate()
        json.dump(master_json, master_file, ensure_ascii=False, indent=4)
    return master_json, new_files


# In the spirit of making incremental updates as fast as possible, the blockchain will be serialized, like the master.
def blockmap(master):
    mapping = os.environ.get("BLOCKCHAIN", "mapping.pickle")
    # Load our past mapping to pick up where we left off
    try:
        blockchain = pickle.load(open(mapping, "rb"))
    except (OSError, IOError):
        blockchain = Blockchain()

    for item in master:
        # Skip previously mapped blocks from being re-mapped
        if blockchain.has(item):
            continue
        item_hash = item
        parent = master[item]["protocol_state"]["previous_state_hash"]
        height = master[item]["protocol_state"]["body"]["consensus_state"]["global_slot_since_genesis"]
        timestamp = master[item]["scheduled_time"]
        block = Block(item_hash, parent, height, timestamp)
        blockchain.add(block)
    pickle.dump(blockchain, open(mapping, "wb"))
    return blockchain


# This will validate the blockchain, update both the blockchain and master with any corrections, and save both to file.
def validate(blockchain, master, verbose):
    report = blockchain.validate(master, verbose)
    blockchain_file = os.environ.get("BLOCKCHAIN", "mapping.pickle")
    master_file = os.path.abspath(os.environ.get("MASTER", "master.json"))
    blockchain.save(blockchain_file)
    with open(master_file, "w", encoding="ISO-8859-1") as new_master:
        new_master.seek(0)
        new_master.truncate()
        json.dump(master, new_master, ensure_ascii=False, indent=4)
    return report


# Marks the canonical chain as such.
# THIS IS NOT WORKING AS INTENDED
def paint(blockchain):
    canonical = blockchain.canonical()
    while canonical is not None:
        canonical.canon = True
        canonical = blockchain.get(canonical.parent)


# Creates a set of forks from the blockchain and returns it
def process(blockchain, master):
    forks = []
    endpoints = blockchain.endpoints()

    for head in endpoints:
        if head.canon:  # The canonical head is technically an endpoint, so skip it
            continue
        container = {}
        while not head.canon:
            container[head.hash] = master[head.hash]
            head = blockchain.get(head.parent)
        forks.append(container)
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
            staged_fork["blocks"]["creator"].insert(0, fork[block]["protocol_state"]["body"]["consensus_state"][
                "block_creator"])
            # Set local variable to the oldest block hash for use later in creating unique ID hash
            if not initialized:
                fork_root = block
                initialized = True
            # Add 1440 mina to "lost rewards" if the block is supercharged, otherwise 720
            if fork[block]["protocol_state"]["body"]["consensus_state"]["supercharge_coinbase"]:
                staged_fork["rewards"] += 1440
            else:
                staged_fork["rewards"] += 720
            # Update the 'latest' and 'last_updated' fields according to our most recent block
            if int(fork[block]["scheduled_time"]) > int(staged_fork["last_updated"]):
                staged_fork["last_updated"] = int(fork[block]["scheduled_time"])
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
def powercycle(printout=False, integrity_check=False):
    # Download Blocks
    start = time.time()
    files = download()
    end = time.time()
    if printout:
        print(f"{len(files)} Blocks Synchronized in {end - start} seconds")

    # Parse Blocks
    start = time.time()
    master, new_files = parse(files)
    end = time.time()
    if printout:
        print(f"Parsed {new_files} new Blocks from total Blocks in {end - start} seconds.")

    # Map Blocks
    start = time.time()
    blockchain = blockmap(master)
    end = time.time()
    if printout:
        print(f"Mapped all Blocks in {end - start} seconds.")

    # Validate the blockchain to fix any potential errors before we do work
    # This takes a long time, so you should only do it if you think there's a problem.
    if integrity_check:
        start = time.time()
        report = validate(blockchain, master, printout)
        end = time.time()
        if printout:
            print(f"Verified Blockchain integrity in {end - start} seconds.")
            print(report)

    # Determine canonical status of entire blockchain information
    start = time.time()
    paint(blockchain)
    end = time.time()
    if printout:
        print(f"Painted canonical chain in {end - start} seconds.")

    # Sort forked blocks into arrays of unique forks
    start = time.time()
    forks = process(blockchain, master)
    end = time.time()
    if printout:
        print(f"Processed {len(forks)} Forks in {end - start} seconds.")

    # Place forks into JSON data for upload
    start = time.time()
    staging = stage(forks, master)
    end = time.time()
    if printout:
        print(f"Staged {len(staging)} forks for upload in {end - start} seconds.")

    # # Upload to firebase database
    start = time.time()
    firebase_update(staging)
    end = time.time()
    if printout:
        print(f"Uploaded {len(staging)} total forks with the FireBase database in {end - start} seconds.")


if __name__ == '__main__':
    powercycle(printout=True, integrity_check=False)
