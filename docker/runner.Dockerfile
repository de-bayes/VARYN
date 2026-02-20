FROM rocker/r-ver:4.4.1

# System deps for R packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcurl4-openssl-dev libssl-dev libxml2-dev \
    libfontconfig1-dev libfreetype6-dev libpng-dev libtiff5-dev \
    && rm -rf /var/lib/apt/lists/*

# Install allowlisted R packages
RUN R -e "install.packages(c( \
    'haven', 'readr', 'dplyr', 'tidyr', \
    'ggplot2', 'fixest', 'estimatr', \
    'broom', 'modelsummary', 'jsonlite', 'base64enc', \
    'plumber' \
  ), repos='https://cran.r-project.org/', Ncpus=4)"

WORKDIR /app
COPY apps/runner/ /app/

# No outbound network at runtime — block in docker-compose / Railway
EXPOSE 6274

CMD ["Rscript", "server.R"]
