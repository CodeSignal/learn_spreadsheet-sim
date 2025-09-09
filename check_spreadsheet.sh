#!/bin/bash

rm  -f spreadsheet.json
node spreadsheetToJson.js
cat spreadsheet.json
