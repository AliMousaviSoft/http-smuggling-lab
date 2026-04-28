FROM haproxy:2.8
USER root
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN openssl req -x509 -newkey rsa:2048 -keyout /etc/ssl/haproxy.key \
    -out /etc/ssl/haproxy.crt -days 365 -nodes \
    -subj "/CN=localhost"
RUN cat /etc/ssl/haproxy.crt /etc/ssl/haproxy.key > /etc/ssl/haproxy.pem
USER haproxy
COPY haproxy.cfg /usr/local/etc/haproxy/haproxy.cfg
