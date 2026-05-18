export * from "./client"
export * from "./host"
export * from "./interfaces"
export * from "./protocols"
export * from "./domains"
export * from "./permissions"
export * from "./widgets"
export * from "./core/channels"
export { EventName } from "./core/protocol"

export const sum = (a: number, b: number) => {
  if ('development' === process.env.NODE_ENV) {
    console.log('boop');
  }
  return a + b;
};
