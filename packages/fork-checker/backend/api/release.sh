gcloud run deploy --image gcr.io/sv-mina-forks/fork-checker-api:$1 --service-account $2 --platform managed fork-checker-api --region us-west1 --project sv-mina-forks --set-env-vars "ENV=PRODUCTION"