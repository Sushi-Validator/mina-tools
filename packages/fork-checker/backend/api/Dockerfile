# Dockerfile
FROM python:3.7-stretch
RUN apt-get update -y
RUN apt-get install -y python-pip python-dev build-essential
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app.py .
ENTRYPOINT ["python"]
CMD ["app.py"]