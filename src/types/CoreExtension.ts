import { ChannelService } from './ChannelService';
import { TelemetryService } from './TelemetryService';
import { WorkspaceContext } from './WorkspaceContext';

export interface CoreExtensionApi {
  services: {
    ChannelService: ChannelService;
    TelemetryService: TelemetryService;
    WorkspaceContext: WorkspaceContext;
  };
}
