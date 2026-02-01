module.exports = {
  content: ['out/*.html', 'out/_next/static/chunks/*.js'],
  css: ['out/_next/static/chunks/*.css'],
  output: 'out/_next/static/chunks',
  safelist: {
    deep: [/modal$/, /modal-(.)*$/, /btn-close(.)*$/, /awssld/, /col-/, /bg-(success|danger)$/],
  },
};
