rm -rf ./app
mkdir -p app
jupyter nbconvert --to script massive-fees.ipynb 
mv massive-fees.py ./app/main.py

docker build -f Dockerfile -t gcr.io/sushivalidator/massive-fees-app:dev .