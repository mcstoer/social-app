import { AppBskyFeedDefs } from '@atproto/api';
import { Cursor } from './Cursor';

/**
 * StringCursorManager: Manages cursor creation, retrieval, and string representation.
 *
 * This class is responsible for creating, retrieving, and serializing Cursor instances.
 * It maintains a list of cursors and provides methods to convert them to and from
 * string representations for storage and transmission.
 */
export class StringCursorManager {
  private cursorList: Cursor[] = [];

  /**
   * create(): Creates a new Cursor instance and adds it to the cursor list.
   *
   * @param targetWindowSize - The target size of the shuffled sliding window.
   * @param sourcePostLists - The lists of posts from the feed sources.
   * @returns The newly created Cursor instance.
   */
  create(
    targetWindowSize: number,
    sourcePostLists: AppBskyFeedDefs.FeedViewPost[][],
  ): Cursor {
    const cursor = new Cursor(targetWindowSize, sourcePostLists);
    this.cursorList.push(cursor);
    return cursor;
  }

  /**
   * find(): Retrieves a Cursor instance from the cursor list using its string representation.
   *
   * @param cursorString - The string representation of the Cursor.
   * @returns The Cursor instance, or throws an error if not found.
   */
  find(cursorString: string): Cursor {
    const parts = cursorString.split('-');
    if (parts.length !== 3) {
      throw new Error('Invalid cursor string');
    }

    const index = parseInt(parts[1], 10);
    const postsGiven = parseInt(parts[2], 10);

    if (index < 0 || index >= this.cursorList.length) {
      throw new Error('Cursor index out of bounds');
    }

    if (this.cursorList[index].postsGiven() !== postsGiven) {
      throw new Error('Cursor posts given mismatch');
    }

    return this.cursorList[index];
  }

  /**
   * emit(): Generates a string representation of a Cursor instance.
   *
   * @param cursor - The Cursor instance to serialize.
   * @returns The string representation of the Cursor.
   */
  emit(cursor: Cursor): string {
    const index = this.cursorList.indexOf(cursor);
    const postsGiven = cursor.postsGiven();
    return `cursor-${index}-${postsGiven}`;
  }
}