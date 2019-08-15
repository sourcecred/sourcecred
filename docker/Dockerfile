FROM ubuntu:18.04

RUN apt-get -yqq update && apt-get -yqq upgrade && apt-get -yqq install \
  wget git \
  && apt-get purge && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install NodeJS + yarn with conda
RUN \
  wget -q https://repo.anaconda.com/miniconda/Miniconda2-4.7.10-Linux-x86_64.sh -O /tmp/miniconda.sh \
  && echo '3bc6ffc6cda8efa467926dfd92a30bca */tmp/miniconda.sh' | md5sum -c - \
  && bash /tmp/miniconda.sh -f -b -p /opt/conda \
  && rm /tmp/miniconda.sh \
  && /opt/conda/bin/conda update --all -y -c conda-forge \
  && /opt/conda/bin/pip install --no-cache-dir -U pip \
  && /opt/conda/bin/conda install -y -c conda-forge nodejs yarn \
  && /opt/conda/bin/conda clean -a -y
ENV PATH=/opt/conda/bin:$PATH

# TODO: OOPS
RUN apt-get -yqq update && apt-get -yqq upgrade && apt-get -yqq install \
  make g++ \
  && apt-get purge && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY . /opt/sourcecred
WORKDIR /opt/sourcecred

RUN yarn install && yarn backend
EXPOSE 8080
ENTRYPOINT ["/opt/sourcecred/docker/entrypoint.sh"]
