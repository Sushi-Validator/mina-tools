rm -rf ./app
mkdir -p app
jupyter nbconvert --to script exchange-mistakes.ipynb 
mv exchange-mistakes.py ./app/main.py

docker build -f Dockerfile -t gcr.io/sushivalidator/exchange-mistakes-app:dev .