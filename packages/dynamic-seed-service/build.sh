rm -rf ./app
mkdir -p app
jupyter nbconvert --to script DynamicNodeSeedList.ipynb 
mv DynamicNodeSeedList.py ./app/main.py

docker build -f Dockerfile -t gcr.io/sushivalidator/dynamic-seed-service:dev .