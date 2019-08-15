FROM node:12-slim

RUN apt-get -yqq update && apt-get -yqq upgrade && apt-get -yqq install \
    apt-transport-https \
  && curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - \
  && echo "deb https://dl.yarnpkg.com/debian/ stable main" \
    | tee /etc/apt/sources.list.d/yarn.list \
  && apt-get -yqq update && apt-get -yqq upgrade && apt-get -yqq install \
    yarn make g++ python git \
  && apt-get purge && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY . /opt/sourcecred
WORKDIR /opt/sourcecred

RUN yarn install && yarn backend
EXPOSE 8080
ENV SOURCECRED_DIRECTORY=/opt/sourcecred/data
ENTRYPOINT ["/opt/sourcecred/docker/entrypoint.sh"]
