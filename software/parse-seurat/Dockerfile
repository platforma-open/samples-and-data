FROM r-base:4.4.2

ENV R_VERSION=4.4.2
ENV BIOCONDUCTOR_VERSION=3.20
ENV RENV_VERSION=1.0.11
ENV RENV_CONFIG_PPM_ENABLED=false
ENV RENV_CONFIG_REPOS_OVERRIDE=https://cloud.r-project.org

# Install system dependencies required for R packages
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libcairo2-dev \
    libgit2-dev \
    default-libmysqlclient-dev \
    libpq-dev \
    libsasl2-dev \
    libsqlite3-dev \
    libssh2-1-dev \
    unixodbc-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    libgsl-dev \
    libbz2-dev \
    liblzma-dev \
    libpcre2-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

RUN R -e "install.packages('renv', repos = 'https://cloud.r-project.org')"

# .Rprofile breaks renv restore
# Copy only files that are needed
COPY *.R .
COPY ./renv.lock ./renv.lock

# Have to use absolute paths because during execution the working directory will be changed
# and realpath command does not work
ENV RENV_PATHS_RENV=/app/renv
ENV RENV_PATHS_LOCKFILE=/app/renv.lock

# Direct renv to install into a project-local library (instead of the
# system-wide /usr/local/lib/R/site-library) and expose that path to R via
# R_LIBS_USER so Rscript finds the packages at runtime without any renv code.
ENV R_LIBS_USER=/app/renv/library
ENV RENV_PATHS_LIBRARY=${R_LIBS_USER}

# Yes, we have to create it manually. Otherwise default will be used silently.
RUN mkdir -p "${R_LIBS_USER}"

RUN R --no-echo -e "renv::restore(clean = TRUE)" \
    && find /root/.cache/R -name keys.html -delete \
    && find /usr/local/lib/R -name keys.html -delete