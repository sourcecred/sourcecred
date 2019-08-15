FROM node:10
# docker build -t sourcecred .
# available at vanessa/sourcecred if you don't want to build
RUN apt-get update && \
    apt-get install -y apt-transport-https python
RUN apt-get install -y build-essential && \
    mkdir -p /code
WORKDIR /code
ARG SOURCECRED_DIRECTORY=/data
ADD . /code
RUN curl --compressed -o- -L https://yarnpkg.com/install.sh | bash && \
    yarn && \
    yarn backend
ENTRYPOINT ["/bin/bash", "/code/scripts/docker-entrypoint.sh"]
