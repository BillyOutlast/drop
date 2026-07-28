# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- CI workflows for sites/promo, sites/docs, and desktop/main
- Pre-commit hooks for Rust formatting and fallow gate
- Reference test for auth route handlers (h3 factory pattern)
- Fallow.toml with Nuxt path excludes
- PR and issue templates

### Fixed

- SonarQube exclusion for Prisma migrations
- libarchive recursive read_block() converted to iterative loop
- ESLint no-prisma-delete rule narrowed to entity allowlist
- Tauri plugin versions pinned in root Cargo.toml
- Prisma indexes on Client and Session tables
- Promise boolean await in session signout

### Changed

- Migrated partial jsonwebtoken usage to jose

### Security

- Replaced MD5 with SHA-256 for non-security use cases
