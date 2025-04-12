import { RichText } from '@atproto/api';
import {SavedFeedSourceInfo} from '#/state/queries/feed';
import { aiModeFeedDescriptor } from './types';

// See Google Document about structure of SavedFeedSourceInfo to learn more about the fields.
export const aiModeFeedInfo: SavedFeedSourceInfo = {
  type: 'feed',
  displayName: 'AI mode',
  uri: aiModeFeedDescriptor,
  feedDescriptor: aiModeFeedDescriptor,
  route: {
    href: '/',
    name: 'Home',
    params: {},
  },
  cid: '',
  avatar: '',
  description: new RichText({text: ''}),
  creatorDid: '',
  creatorHandle: '',
  likeCount: 0,
  likeUri: '',
  // ---
  savedFeed: {
    id: aiModeFeedDescriptor,
    type: 'feed',
    value: aiModeFeedDescriptor,
    pinned: true,
  },
  contentMode: undefined,
};