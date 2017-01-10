const path = require('path');

const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: {
    handler: path.join(__dirname, './src/handler.ts'),
  },
  target: 'node',
  module: {
    loaders: [
      { test: /\.ts(x?)$/, loader: 'ts-loader' }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx', '']
  },
  externals: [nodeExternals()],
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js'
  },
};
