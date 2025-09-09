#!/bin/bash

rm  -fspreadsheet.json
node spreadsheetToJson.js
cat spreadsheet.json
