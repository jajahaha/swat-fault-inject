# JDBC Drivers

This directory is for storing JDBC driver jar files for database connections.

## Supported Drivers

### GaussDB JDBC Driver
- File: `gaussdbjdbc.jar`
- Download from: Huawei GaussDB official website
- Driver class: `com.huawei.gaussdb.jdbc.Driver`

### openGauss JDBC Driver
- File: `opengaussjdbc.jar`
- Download from: openGauss official website
- Driver class: `org.opengauss.Driver`

### PostgreSQL JDBC Driver
- File: `postgresqljdbc.jar`
- Download from: https://jdbc.postgresql.org/download.html
- Driver class: `org.postgresql.Driver`

## Usage

1. Download the appropriate JDBC driver jar file
2. Place it in this `drivers/` directory
3. Configure the database connection with:
   - Connection method: JDBC
   - JDBC driver path: `drivers/gaussdbjdbc.jar` (relative path)