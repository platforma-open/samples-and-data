FROM r-base:4.4.2

ENV R_VERSION=4.4.2
ENV BIOCONDUCTOR_VERSION=3.20
ENV RENV_VERSION=1.0.11
ENV RENV_CONFIG_PPM_ENABLED=false
ENV RENV_CONFIG_REPOS_OVERRIDE=https://cloud.r-project.org

# Install system dependencies required for R packages
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    dash \
    default-libmysqlclient-dev \
    libbz2-dev \
    libcairo2-dev \
    libcurl4-openssl-dev \
    libfreetype6-dev \
    libfribidi-dev \
    libgit2-dev \
    libgsl-dev \
    libharfbuzz-dev \
    libjpeg-dev \
    liblzma-dev \
    libpcre2-dev \
    libpng-dev \
    libpq-dev \
    libsasl2-dev \
    libsqlite3-dev \
    libssh2-1-dev \
    libssl-dev \
    libtiff5-dev \
    libuv1-dev \
    libxml2-dev \
    unixodbc-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

RUN R -e "install.packages('renv', repos = 'https://cloud.r-project.org')"

# .Rprofile breaks renv restore
# Copy only files that are needed
COPY *.R .
COPY ./renv.lock ./renv.lock

# Some block-software docker cmds invoke the .R script directly (relying on the
# `#!/usr/bin/env Rscript` shebang) rather than via `Rscript /app/script.R`.
# COPY preserves the 0644 mode from git, so the direct invocation fails with
# `Permission denied`. Make every entry script executable here — harmless for
# blocks whose cmd already prefixes Rscript.
RUN chmod +x /app/*.R

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

# First pass: parallel install (fast for the bulk of packages).
# Second pass: sequential retry to resolve any parallel-install races
# (e.g. ggplot2 starting before tibble is visible in the library).
RUN R --no-echo -e "tryCatch(renv::restore(), error = function(e) message('parallel pass finished with errors: ', conditionMessage(e))); options(Ncpus = 1); renv::restore(clean = TRUE)" \
    && find /root/.cache/R -name keys.html -delete \
    && find /usr/local/lib/R -name keys.html -delete \
    && find "${R_LIBS_USER}" -name keys.html -delete
