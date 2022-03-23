FROM python:3.9-slim

RUN \
  apt-get update && \
  apt-get install -y ca-certificates curl && \
  apt-get clean

# Google Cloud SDK 
RUN curl -sSL https://sdk.cloud.google.com | bash
# RUN echo "if [ -f '/root/google-cloud-sdk/path.bash.inc' ]; then . '/root/google-cloud-sdk/path.bash.inc'; fi" >> /root/.bashrc
# RUN echo "if [ -f '/root/google-cloud-sdk/completion.bash.inc' ]; then . '/root/google-cloud-sdk/completion.bash.inc'; fi" >> /root/.bashrc

#Kubectl
RUN curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
RUN chmod +x ./kubectl
RUN mv ./kubectl /usr/local/bin


ENV PYTHONUNBUFFERED True
ENV PORT 8080
ENV PATH /root/google-cloud-sdk/bin/:${PATH}

WORKDIR /tmp
COPY requirements.txt .
RUN pip3 install -r requirements.txt 

WORKDIR /app
COPY ./app /app

# Run the web service on container startup. Here we use the gunicorn
# webserver, with one worker process and 8 threads.
# For environments with multiple CPU cores, increase the number of workers
# to be equal to the cores available.
# Timeout is set to 0 to disable the timeouts of the workers to allow Cloud Run to handle instance scaling.
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:server