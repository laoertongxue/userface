import type {
  CommunityId,
  ConnectorMode,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

export type CommunityCatalogEntry = {
  id: CommunityId;
  label: string;
  mode: ConnectorMode;
  status: 'scaffolded' | 'planned';
};

export const communityCatalog: CommunityCatalogEntry[] = [
  {
    id: 'v2ex',
    label: 'V2EX',
    mode: 'public',
    status: 'scaffolded',
  },
  {
    id: 'guozaoke',
    label: '过早客',
    mode: 'public',
    status: 'scaffolded',
  },
  {
    id: 'weibo',
    label: '微博',
    mode: 'oauth',
    status: 'planned',
  },
];
