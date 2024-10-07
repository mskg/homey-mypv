import Homey from 'homey';
import axios from 'axios';

module.exports = class extends Homey.Device {

  pollingTask: NodeJS.Timeout | undefined;

  async onInit() {
    this.log('API Device has been initialized');
    this.startPolling();
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
    this.startPolling();
  }

  startPolling() {
    // Clear any existing intervals
    if (this.pollingTask) this.homey.clearInterval(this.pollingTask);

    const refreshInterval = this.getSetting('interval') < 10
      ? 10 // refresh interval in seconds minimum 10
      : this.getSetting('interval');

    // Set up a new interval
    this.pollingTask = this.homey.setInterval(this.fetchData.bind(this), refreshInterval * 1000);
  }

  // eslint-disable-next-line no-empty-function
  async setCapabilities(data: any) {
    this.log('Fetched', data);

    await Promise.all([
      this.setCapabilityValue('measure_temperature.t1', data.temp1 / 10),
      this.setCapabilityValue('measure_temperature.ps', data.temp_ps / 10),

      // await this.setCapabilityValue('measure_temperature.t2', data.temp2 / 10);
      // await this.setCapabilityValue('measure_temperature.t3', data.temp3 / 10);
      // await this.setCapabilityValue('measure_temperature.t4', data.temp4 / 10);

      this.setCapabilityValue('mypv_state_control', data.ctrlstate),
      this.setCapabilityValue('mypv_state_mode', `${data.screen_mode_flag}`),

      this.setCapabilityValue('measure_power', data.power_act),
    ]);
    /*
{
  device: 'ACTHOR',
  acthor9s: 1,
  fwversion: 'a0021702',
  psversion: 111,
  p9sversion: null,
  fsetup: 0,
  screen_mode_flag: 4,
  power_system: null,
  power_act: 0,
  power_solar_act: 0,
  power_grid_act: 0,
  power_ac9: null,
  power_solar_ac9: null,
  power_grid_ac9: null,
  power1_solar: 0,
  power1_grid: 0,
  power2_solar: 0,
  power2_grid: 0,
  power3_solar: null,
  power3_grid: null,
  load_state: '0',
  load_nom: 0,
  rel1_out: '0',
  pump_pwm: 0,
  power_nominal: 1500,
  power_max: 0,
  temp1: 606,
  temp2: null,
  temp3: null,
  temp4: null,
  boostactive: 0,
  legboostnext: 'null',
  date: '07.10.24',
  loctime: '10:31:32',
  unixtime: 1728289892,
  uptime: 90,
  wp_flag: 0,
  wp_time1_ctr: 0,
  wp_time2_ctr: 0,
  wp_time3_ctr: 0,
  schicht_flag: 0,
  act_night_flag: 0,
  ctrlstate: 'Conn. to Adj.Modbus P=496',
  blockactive: 0,
  error_state: 0,
  meter1_id: null,
  meter1_ip: 'null',
  meter2_id: null,
  meter2_ip: 'null',
  meter3_id: null,
  meter3_ip: 'null',
  meter4_id: null,
  meter4_ip: 'null',
  meter5_id: null,
  meter5_ip: 'null',
  meter6_id: null,
  meter6_ip: 'null',
  meter_ss: null,
  meter_ssid: 'null',
  surplus: -496,
  m0sum: -496,
  m0l1: null,
  m0l2: null,
  m0l3: null,
  m0bat: null,
  m1sum: null,
  m1l1: null,
  m1l2: null,
  m1l3: null,
  m1devstate: null,
  m2sum: null,
  m2l1: null,
  m2l2: null,
  m2l3: null,
  m2soc: null,
  m2state: null,
  m2devstate: null,
  m3sum: null,
  m3l1: null,
  m3l2: null,
  m3l3: null,
  m3soc: null,
  m3devstate: null,
  m4sum: null,
  m4l1: null,
  m4l2: null,
  m4l3: null,
  m4devstate: null,
  ecarstate: 'null',
  ecarboostctr: null,
  mss2: 'null',
  mss3: 'null',
  mss4: 'null',
  mss5: 'null',
  mss6: 'null',
  mss7: 'null',
  mss8: 'null',
  mss9: 'null',
  mss10: 'null',
  mss11: 'null',
  volt_mains: 228,
  curr_mains: 0,
  volt_L2: null,
  curr_L2: null,
  volt_L3: null,
  curr_L3: null,
  volt_out: 0,
  freq: 49994,
  temp_ps: 254,
  fan_speed: 0,
  ps_state: 0,
  '9s_state': null,
  cur_ip: '192.168.241.86',
  cur_sn: '255.255.255.0',
  cur_gw: '192.168.241.254',
  cur_dns: '192.168.241.254',
  fwversionlatest: 'a0021702',
  psversionlatest: 111,
  p9sversionlatest: null,
  upd_state: 0,
  upd_files_left: 0,
  ps_upd_state: 0,
  p9s_upd_state: null,
  cloudstate: 4,
  debug_ip: '0.0.0.0'
}

    */
  }

  async fetchData() {
    const serial = this.getSetting('serial');
    const token = this.getSetting('token');

    if (!serial || serial === '' || !token || token === '') {
      this.log('Missing settings.');
      return;
    }

    try {
      const response = await axios.get(
        `https://api.my-pv.com/api/v1/device/${serial}/data`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      await this.setCapabilities(response.data);
    } catch (error: any) {
      this.error('Failed to fetch data:', error);
    }
  }

  onDeleted() {
    this.log('Device has been deleted');

    // Clear the interval when the device is deleted
    this.homey.clearInterval(this.pollingTask);
  }

};
