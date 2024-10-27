# NATSrun

> [!CAUTION]
> This is a WIP and not yet published to NPM

## Intro

Simple application message router using NATS subject pattern-matching.

Based on core [Hemera](https://github.com/hemerajs/hemera) and [Seneca](https://github.com/senecajs/seneca) pattern-matching libraries - [bloomrun](https://github.com/mcollina/bloomrun) and [patrun](https://github.com/rjrodger/patrun).

## Why?

The purpose of this library is similar to Hemera, in that it aims to allow you to easily define NATS-based Typescript services using the same subject pattern-matching that as NATS.

This should allow for very simple Express/Koa-esque wiring between a NATS consumer and a business logic.

## Examples

*Coming Soon*

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

# TODO

- [ ] Add examples and use cases
- [ ] Make bloomrun.ts its own repo/library  
- [ ] More configurations for the run (exectution order, async)  
- [ ] Tests for different configurations
- [ ] Github actions
- [ ] Publish
