# easyretro.io export

> API or CLI tool to export easy retro boards. 

## Installing / Getting started

It's required to have [npm](https://www.npmjs.com/get-npm) installed locally to follow the instructions.

It's required to have [node](https://nodejs.org/en/download/) installed locally to follow the instructions.

```shell
git clone https://github.com/abnegru31/easyretro-exporter.git
cd easyretro-exporter
npm install

# Use API or CLI.

# Starting API (Exposes port 3000 by default)
npm run start

# Using CLI
# Showing available commands
npm run cli -- -h
# Show available params for download
# If wanting custom export location, do this command to see how
npm run cli -- download -h
# Perform a export in csv format
npm run cli -- download -u=https://easyretro.io/... -f=csv
# Perform a export in legacy format
npm run cli -- download -u=https://easyretro.io/... -f=legacy
```


## API available endpoints

* `GET /v1/get-easy-retro-data?url=<https://easyretro.io...>`
* `GET /v1/download-easy-retro-board?format=<legacy|csv>`

`get-easy-retro-data` path returns a JSON response of the gathered data
`download-easy-retro-board` path exports a csv or text file depending on what was chosen for the format query param.
*Note*: the get-easy-retro-data must be performed first before a valid export can occur

### Example export request using cURL

```shell
# This will return a JSON response of the found data that can be reused.
curl -G --location --request GET 'http://localhost:3000/v1/get-easy-retro-data' \
--data-urlencode 'url=https://easyretro.io/publicboard/....'

# Now to download the data in a desired format

# CSV
curl -G --location --request GET 'http://localhost:3000/v1/download-easy-retro-board' \
--data-urlencode 'format=csv'

# Legacy

curl -G --location --request GET 'http://localhost:3000/v1/download-easy-retro-board' \
--data-urlencode 'format=legacy'
```