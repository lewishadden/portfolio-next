module.exports = {
  content: ['out/**/*.html', 'out/_next/static/chunks/**/*.js'],
  css: ['out/_next/static/css/*.css'],
  output: 'out/_next/static/css',
  safelist: {
    deep: [/modal$/, /modal-(.)*$/, /btn-close(.)*$/, /awssld/, /col-/],
  },
};
