module.exports = function (options) {
  return {
    ...options,
    module: {
      ...options.module,
      rules: [
        ...options.module.rules,
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      ...options.resolve,
      extensions: [...options.resolve.extensions, '.tsx', '.ts', '.js'],
    },
  };
};
