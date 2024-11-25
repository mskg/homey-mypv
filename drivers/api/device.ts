import Homey from 'homey';
import axios from 'axios';

module.exports = class extends Homey.Device {

  pollingTaskReference: NodeJS.Timeout | undefined;

  async onInit() {
    this.log('API Device has been initialized');

    await this.registerCapabilityListener('onoff', (val) => this.setField('devmode', val ? 0 : 1, 'data'));
    await this.registerCapabilityListener('mypv_target', (val) => this.setField('ptarget', val));
    await this.registerCapabilityListener('target_temperature.t1', (val) => this.setField('ww1target', val * 10));

    await this.startPolling();
  }

  async onAdded() {
    this.log('API Device has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('API Device settings where changed');
    await this.startPolling();
  }

  async startPolling() {
    if (this.pollingTaskReference) {
      this.homey.clearInterval(this.pollingTaskReference);
    }

    const serial = this.getSetting('serial');
    const token = this.getSetting('token');
    const ip = this.getSetting('ip');

    if ((!ip || ip === '') && (!serial || serial === '' || !token || token === '')) {
      this.log('Missing settings.');
      return;
    }

    const refreshInterval = this.getSetting('interval') < 10
      ? 10 // refresh interval in seconds minimum 10
      : this.getSetting('interval');

    this.log('Interval is', refreshInterval);

    await this.pollingTask();

    // Set up a new interval
    this.pollingTaskReference = this.homey.setInterval(this.pollingTask.bind(this), refreshInterval * 1000);
  }

  // eslint-disable-next-line no-empty-function
  async pollingTask() {
    const data = await this.fetchData('data');
    const setup = await this.fetchData('setup');

    if (!data || !setup) {
      return;
    }

    const mode = data.screen_mode_flag;

    await Promise.all([
      this.setCapabilityValue('measure_temperature.t1', data.temp1 / 10),
      this.setCapabilityValue('measure_temperature.ps', data.temp_ps / 10),

      // await this.setCapabilityValue('measure_temperature.t2', data.temp2 / 10);
      // await this.setCapabilityValue('measure_temperature.t3', data.temp3 / 10);
      // await this.setCapabilityValue('measure_temperature.t4', data.temp4 / 10);

      this.setCapabilityValue('mypv_state_control', data.ctrlstate),
      this.setCapabilityValue('mypv_state_mode', `${mode}`),

      this.setCapabilityValue('measure_power', data.power_act),
      // eslint-disable-next-line eqeqeq
      this.setCapabilityValue('onoff', data.screen_mode_flag != 4),

      this.setCapabilityValue('mypv_target', setup.ptarget),
      this.setCapabilityValue('target_temperature.t1', setup.ww1target / 10),
    ]);
  }

  getEndpoint(name: string = 'data'): string {
    const ip = this.getSetting('ip');
    const serial = this.getSetting('serial');

    return ip && ip !== ''
      ? `http://${ip}/${name}.jsn`
      : `https://api.my-pv.com/api/v1/device/${serial}/${name}`;
  }

  async setField(name: string, val: number | string, endpoint: string = 'setup') {
    try {
      const url = this.getEndpoint(endpoint);
      this.log('Fetching', url);

      await axios.get(
        `${url}?${name}=${val}`,
        {
          headers: {
            Authorization: `Bearer ${this.getSetting('token')}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );
    } catch (error: any) {
      this.error('Failed to fetch data:', error);
    }
  }

  async fetchData(endpoint: string = 'data') {
    try {
      const url = this.getEndpoint(endpoint);
      this.log('Fetching', url);

      const response = await axios.get(
        url,
        {
          headers: {
            Authorization: `Bearer ${this.getSetting('token')}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.error('Failed to fetch data:', error);
      return null;
    }
  }

  onDeleted() {
    this.log('Device has been deleted');

    // Clear the interval when the device is deleted
    this.homey.clearInterval(this.pollingTaskReference);
  }

};
