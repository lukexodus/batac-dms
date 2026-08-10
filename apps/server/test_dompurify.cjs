const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const dirty = `
  <p>Test <a href="https://example.com">Link</a></p>
  <u>Underline</u>
  <h3>Heading 3</h3>
  <h4>Heading 4</h4>
  <blockquote>Quote</blockquote>
  <hr>
  <s>Strike1</s>
  <strike>Strike2</strike>
`;

console.log(DOMPurify.sanitize(dirty));
