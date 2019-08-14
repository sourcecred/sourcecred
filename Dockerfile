FROM node:10
# docker build -t sourcecred .
# available at vanessa/sourcecred if you don't want to build
RUN apt-get update && \
    apt-get install -y apt-transport-https python
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    apt-get update && \
    apt-get install -y yarn build-essential && \
    mkdir -p /code
WORKDIR /code
ADD . /code
RUN curl --compressed -o- -L https://yarnpkg.com/install.sh | bash && \
    yarn && \
    yarn backend
ENTRYPOINT ["/bin/bash", "/code/scripts/docker-entrypoint.sh"]
