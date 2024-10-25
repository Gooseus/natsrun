# NATSrun

## Intro

Simple application message router using NATS subject pattern-matching.

Based on core [Hemera](https://github.com/hemerajs/hemera) and [Seneca](https://github.com/senecajs/seneca) pattern-matching libraries - [bloomrun](https://github.com/mcollina/bloomrun) and [patrun](https://github.com/rjrodger/patrun).

This library is currently dependent on [bloomrun](https://github.com/mcollina/bloomrun), though not for long as the core matching algorithm has already been modified for NATS pattern-matching, also bloomrun is without types or updates in many years.

## Why?

The purpose of this library is similar to Hemera, in that it aims to allow you to easily define NATS-based Typescript services using the same subject pattern-matching that as NATS.

This should allow for very simple Express/Koa-esque wiring between a NATS consumer and a business logic.

## Examples

## Tests

This project uses the built-in Node test runner, and imports [tsx](https://github.com/privatenumber/tsx) to run them directly as Typescript.

```sh
$ npm run test
```

## Docs

This project uses Typedoc for docs, they can be generated and run with [http-server](https://github.com/http-party/http-server).

```sh
$ npm run build:docs
$ http-server docs
```
