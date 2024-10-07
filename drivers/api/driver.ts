import Homey from 'homey';
import axios from 'axios';

module.exports = class extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('API Driver has been initialized');
  }

  async onPairListDevices() {
    return [];
  }

  async onPair(session: any) {
    let devices: any = [];

    // this is called when the user presses save settings button in start.html
    session.setHandler('get_devices', async (data: any, callback: any) => {
      this.log('Data', data, 'Devices', devices);

      try {
        const response = await axios.get(
          `https://api.my-pv.com/api/v1/device/${data.serial}/data`,
          {
            headers: {
              Authorization: `Bearer ${data.token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        );

        if (!response.data.device) {
          session.emit('not_found', null);
        } else {
          devices = [{
            name: response.data.device,
            settings: data,
            data: {
              id: data.serial,
            },
          }];

          // ready to continue pairing
          session.emit('found', null);
        }
      } catch (e) {
        this.log(e);
        session.emit('not_found', null);
      }
    });

    // pairing: start.html -> get_devices -> list_devices -> add_devices
    session.setHandler('list_devices', (data: any, callback: any) => {
      this.log('Data', data, 'Devices', devices);
      return devices;
    });
  }

};
