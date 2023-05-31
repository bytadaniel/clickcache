import { Queue } from "../src/queue/queue";

describe('Queue', () => {
  let queue: Queue<number>;

  beforeEach(() => {
    queue = new Queue<number>();
  });

  test('enqueue adds elements to the queue', () => {
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    expect(queue.size()).toBe(3);
  });

  test('dequeue removes and returns elements from the queue', () => {
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    const firstElement = queue.dequeue();
    const secondElement = queue.dequeue();
    const thirdElement = queue.dequeue();

    expect(firstElement).toBe(1);
    expect(secondElement).toBe(2);
    expect(thirdElement).toBe(3);
    expect(queue.size()).toBe(0);
  });

  test('peek returns the front element without removing it', () => {
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    const frontElement = queue.peek();

    expect(frontElement).toBe(1);
    expect(queue.size()).toBe(3);
  });

  test('isEmpty returns true for an empty queue', () => {
    expect(queue.isEmpty()).toBe(true);
  });

  test('isEmpty returns false for a non-empty queue', () => {
    queue.enqueue(1);

    expect(queue.isEmpty()).toBe(false);
  });

  test('clear removes all elements from the queue', () => {
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    queue.clear();

    expect(queue.size()).toBe(0);
  });
});
