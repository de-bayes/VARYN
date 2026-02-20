library(plumber)
library(jsonlite)

# Mount the API
pr <- plumb("R/api.R")

port <- as.integer(Sys.getenv("PORT", "6274"))
cat(sprintf("Varyn R Runner listening on :%d\n", port))
pr$run(host = "0.0.0.0", port = port)
