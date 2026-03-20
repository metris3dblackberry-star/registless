const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// A functions mappa kizárása — Firebase Cloud Functions, nem React Native kód!
config.resolver.blockList = [
  /functions\/.*/,
];

module.exports = config;
