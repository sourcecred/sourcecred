FROM node:12
# docker build -t sourcecred .

# Set up working directory.
RUN mkdir -p /code
WORKDIR /code

# Install global and local dependencies first so they can be cached.
RUN npm install -gf yarn@^1.21.1
COPY package.json yarn.lock /code/
RUN yarn

# Declare data directory.
ARG SOURCECRED_DEFAULT_DIRECTORY=/data
ENV SOURCECRED_DIRECTORY ${SOURCECRED_DEFAULT_DIRECTORY}

# Install the remainder of our code.
COPY . /code
RUN yarn build

ENTRYPOINT ["/bin/bash", "/code/scripts/docker-entrypoint.sh"]
