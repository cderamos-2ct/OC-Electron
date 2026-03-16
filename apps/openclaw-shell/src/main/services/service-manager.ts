import { EventEmitter } from 'events';
import type { ServiceConfig, ServiceStatus, ServiceState } from '../../shared/types.js';
import { HIBERNATION_TIMEOUT_MS } from '../../shared/constants.js';

// TODO: Wire ServiceStore into ServiceManager for persistence.
// Accept an optional ServiceStore in the constructor. On loadService/destroyService/reorder,
// call store methods to persist. On init, load services from the store.
export class ServiceManager extends EventEmitter {
  private services: Map<string, ServiceStatus> = new Map();
  private configs: Map<string, ServiceConfig> = new Map();
  private hibernationTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  loadService(config: ServiceConfig): ServiceStatus {
    const existing = this.services.get(config.id);
    if (existing) {
      return existing;
    }

    this.configs.set(config.id, config);

    const status: ServiceStatus = {
      id: config.id,
      state: 'loading' as ServiceState,
      badgeCount: 0,
      title: config.name,
      url: config.url,
    };

    this.services.set(config.id, status);
    this.emit('state-change', { serviceId: config.id, state: status.state });
    return status;
  }

  getService(id: string): ServiceStatus | undefined {
    return this.services.get(id);
  }

  getServiceConfig(id: string): ServiceConfig | undefined {
    return this.configs.get(id);
  }

  getServiceState(id: string): ServiceState | undefined {
    return this.services.get(id)?.state;
  }

  listServices(): ServiceStatus[] {
    return Array.from(this.services.values());
  }

  setServiceState(id: string, state: ServiceState): ServiceStatus | undefined {
    const status = this.services.get(id);
    if (!status) return undefined;
    status.state = state;
    this.emit('state-change', { serviceId: id, state });
    return status;
  }

  hibernateService(id: string): ServiceStatus | undefined {
    this._clearHibernationTimer(id);
    return this.setServiceState(id, 'hibernated');
  }

  wakeService(id: string): ServiceStatus | undefined {
    this._clearHibernationTimer(id);
    const result = this.setServiceState(id, 'active');
    this._scheduleHibernation(id);
    return result;
  }

  destroyService(id: string): boolean {
    const status = this.services.get(id);
    if (!status) return false;
    this._clearHibernationTimer(id);
    status.state = 'destroyed';
    this.emit('state-change', { serviceId: id, state: 'destroyed' });
    this.services.delete(id);
    this.configs.delete(id);
    return true;
  }

  setBadgeCount(id: string, count: number): ServiceStatus | undefined {
    const status = this.services.get(id);
    if (!status) return undefined;
    status.badgeCount = count;
    return status;
  }

  /** Called when a tab is activated — resets the hibernation countdown. */
  onServiceActivated(id: string): void {
    this._clearHibernationTimer(id);
    const status = this.services.get(id);
    if (status && status.state === 'hibernated') {
      this.wakeService(id);
    } else {
      this._scheduleHibernation(id);
    }
  }

  private _scheduleHibernation(id: string): void {
    this._clearHibernationTimer(id);
    const timer = setTimeout(() => {
      const status = this.services.get(id);
      if (status && status.state === 'active') {
        this.hibernateService(id);
      }
    }, HIBERNATION_TIMEOUT_MS);
    this.hibernationTimers.set(id, timer);
  }

  private _clearHibernationTimer(id: string): void {
    const timer = this.hibernationTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.hibernationTimers.delete(id);
    }
  }
}
