import { type AppBskyActorDefs } from '@atproto/api';

import { type BskyFeedFetcher } from './BskyFeedFetcher';
import { FilterFeedFetcher } from './filter/FilterFeedFetcher';
import { type PostFilter } from './filter/PostFilter';
import { type SavedFeedConverter } from './SavedFeedConverter';


/**
 * FilterSavedFeedConverter: Wraps a SavedFeedConverter to filter out some results out of all fetchers.
 *
 * It is mainly used for AI mode, 
 */
export class FilterSavedFeedConverter {
  // Not an interface so that's not a true decorator.
  private base: SavedFeedConverter;
  private filter: PostFilter;
  
  constructor(base: SavedFeedConverter, filter: PostFilter) {
    this.base = base;
    this.filter = filter;
  }

  convert(savedFeeds: AppBskyActorDefs.SavedFeed[]): BskyFeedFetcher[] {
    const fetcherList: BskyFeedFetcher[] = this.base.convert(savedFeeds);

    for (let i: number = 0; i < fetcherList.length; i++) {
      const fetcher = fetcherList[i];
      fetcherList[i] = new FilterFeedFetcher(fetcher, this.filter);
    }

    return fetcherList;
  }
} 