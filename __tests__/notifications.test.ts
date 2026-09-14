import { urlBase64ToUint8Array } from '../lib/notifications';

test('decodes a base64url string into the expected byte array', () => {
  // "SGVsbG8" is base64url for the ASCII bytes of "Hello"
  expect(Array.from(urlBase64ToUint8Array('SGVsbG8'))).toEqual([72, 101, 108, 108, 111]);
});

test('maps the URL-safe "-" and "_" characters back to standard base64 before decoding', () => {
  // "-_-_" is the URL-safe form of the standard base64 string "+/+/"
  expect(Array.from(urlBase64ToUint8Array('-_-_'))).toEqual([0xfb, 0xff, 0xbf]);
});
