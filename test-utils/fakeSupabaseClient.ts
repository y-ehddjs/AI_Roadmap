export type FakeResult = { data: unknown; error: unknown; count?: number };

export function makeFakeClient(results: FakeResult[]) {
  let index = 0;
  const fromMock = jest.fn(() => {
    const result = results[index] ?? { data: null, error: null };
    index++;
    const builder: any = {
      insert: jest.fn(() => builder),
      update: jest.fn(() => builder),
      upsert: jest.fn(() => builder),
      delete: jest.fn(() => builder),
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      neq: jest.fn(() => builder),
      order: jest.fn(() => builder),
      maybeSingle: jest.fn(() => Promise.resolve(result)),
      single: jest.fn(() => Promise.resolve(result)),
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });
  return { from: fromMock } as any;
}
