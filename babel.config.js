module.exports = function(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ["inline-import", { "extensions": [".sql"] }],
      // Compiles `'worklet'` functions. Reanimated 4 and Vision Camera 5 frame
      // processors both run on react-native-worklets; this re-exports
      // react-native-worklets/plugin and MUST stay last.
      'react-native-reanimated/plugin',
    ]
  };
};
