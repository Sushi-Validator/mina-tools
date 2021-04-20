import requests 
import json
import csv 

# Load Local Addresses
with open("mappings.csv") as fp:
    
    current_mappings = {}

    reader = csv.reader(fp, delimiter=",", quotechar='"')
    headers = next(reader, None)
    for row in reader:
        current_mappings[row[0]] = {
            "public_key": row[0],
            "name": row[1],
            "twitter": row[2], 
            "website": row[3]
        }
    
# Load StakeTab Validators
res = requests.get("https://api.staketab.com/mina/get_providers")
staketab_validators = json.loads(res.text)
staketab_mappings = {}
for validator in staketab_validators["staking_providers"]:
    staketab_mappings[validator["provider_address"]] = {
        "public_key": validator["provider_address"],
        "name": validator["provider_title"],
        "twitter": validator["twitter"],
        "website": validator["website"]
    }

unified = {**staketab_mappings, **current_mappings}

# Write them out to the CSV

with open("mappings.csv", "wt") as fp: 
    writer = csv.writer(fp, delimiter=",")
    writer.writerow(["public_key","friendly_name","twitter_handle","website"])
    for pub in unified.keys():
        writer.writerow([
            pub, 
            unified[pub]["name"],
            unified[pub]["twitter"],
            unified[pub]["website"]
        ])