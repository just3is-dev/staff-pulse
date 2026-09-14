function Widget(props: { style?: object }) {
  return <div>{props.style ? 'styled' : 'plain'}</div>;
}

export function ComponentStyleProp() {
  return <Widget style={{ color: 'red' }} />;
}
