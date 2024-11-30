import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";

export default {
  input: "index.js",
  output: {
    file: "dist/bundle.js",
    format: "cjs",
  },
  plugins: [json(), resolve(), commonjs(), terser()],
};
