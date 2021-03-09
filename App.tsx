/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import React, { useEffect, useState, createContext } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  Button,
  Dimensions,
} from 'react-native';

import {
  Colors,
} from 'react-native/Libraries/NewAppScreen';

import {
  RTCView,
  MediaStream,
  registerGlobals
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import Lightbox from 'react-native-lightbox';

import RNCallKeep from 'react-native-callkeep';

import create from 'zustand'

const callKeepOptions = {
  ios: {
    appName: 'IonCluster',
  },
  android: {
    alertTitle: 'Permissions required',
  //   alertDescription: 'This application needs to access your phone accounts',
  //   cancelButton: 'Cancel',
  //   okButton: 'ok',
  //   imageName: 'phone_account_icon',
  //   additionalPermissions: [PermissionsAndroid.PERMISSIONS.example],
  //   // Required to get audio in background when using Android 11
  //   foregroundService: {
  //     channelId: 'com.company.my',
  //     channelName: 'Foreground service for my app',
  //     notificationTitle: 'My app is running on background',
  //     notificationIcon: 'Path to the resource icon of the notification',
  //   }, 
  }
};


console.log('registering globals')
registerGlobals()
console.log('globals: ', global)

const {Client, RemoteStream, LocalStream} = require('ion-sdk-js')
// import {Client, RemoteStream} from 'ion-sdk-js'
import {IonSFUJSONRPCSignal} from 'ion-sdk-js/lib/signal/json-rpc-impl'

const webrtcConfig = {
  codec: 'h264', 
  sdpSemantics: 'unified-plan',
  iceServers: [
    {'urls': 'stun:stun.l.google.com:19302'},
  ],
}

const HOST = "wss://sfu.dogfood.tandem.chat"
// const HOST = 'ws://localhost:7000'
const SESSION_ID = "eb207afa-a8ea-4e41-bd59-e919b4d6f7c2"
const TOKEN ="eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJyaWQiOiJlYjIwN2FmYS1hOGVhLTRlNDEtYmQ1OS1lOTE5YjRkNmY3YzIiLCJzaWQiOiJlYjIwN2FmYS1hOGVhLTRlNDEtYmQ1OS1lOTE5YjRkNmY3YzIifQ.sWqzn0RtHLJkKRghV0Z6GVQ4EnXG8AiLLpdSY62pFIoV8pU0hDbOOV54mP2A9a6qM3XUzPHjpOWqW1QGcz51Lw"

const ENDPOINT = `${HOST}/session/${SESSION_ID}?access_token=${TOKEN}`

class OfferDebugSignal extends IonSFUJSONRPCSignal {
  async offer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    offer.sdp = offer.sdp.split('640c34').join('42e034')
    offer.sdp = offer.sdp.split('640c1f').join('42e034')
    // console.log('offer: ', offer.sdp)
    const r = await super.offer(offer)
    // console.log('response: ', r.sdp)
    return r
  }


  async answer(answer: RTCSessionDescriptionInit): void {
    console.log('inbound negotiation', answer.sdp)
    answer.sdp = answer.sdp.split('640c34').join('42e034')
    answer.sdp = answer.sdp.split('640c1f').join('42e034') 
    await super.answer(answer)
  }

}

type ClientProps = {
  sessionID: string
}

type IonState = {
  signal: null | OfferDebugSignal,
  client: null | typeof Client,
  sessionID: null | string,
  localStream: null | MediaStream,
  usingRearCamera: boolean,
  usingSpeakerphone: boolean,
  remoteStreams: (typeof RemoteStream)[],
  connectionState: 'disconnected' | 'connecting' | 'connected',

  // //actions
  // switchCameras: () => void, 
  // setSpeaker: () => void,
}

const useIonStore = create<IonState>((set, get) => ({
  signal: null,
  client: null,
  sessionID: '',
  localStream: null,
  usingRearCamera: false,
  usingSpeakerphone: false,
  remoteStreams: [],
  connectionState: 'disconnected', 

  connect: async (sessionID: string) => {
    const signal = new OfferDebugSignal(ENDPOINT)
    const client = new Client(signal, webrtcConfig) 
    set(state => ({client: client, signal: signal}))
    // client.onspeaker = (s) => {console.log('active speakers: ', s)}

    console.log('built signal: ', signal)
    console.log('build client: ', client)
    signal.onopen = async () => {
      console.log('connecting')
      set({connectionState: 'connecting'})
      await client.join(SESSION_ID)
      set({connectionState: 'connected'})
      await publishLocal()
      
      RNCallKeep.addEventListener('didLoadWithEvents', async(events) => {
        // `events` is passed as an Array chronologically, handle or ignore events based on the app's logic
        // see example usage in https://github.com/react-native-webrtc/react-native-callkeep/pull/169 or https://github.com/react-native-webrtc/react-native-callkeep/pull/205
      });
      await RNCallKeep.setup(callKeepOptions)
      RNCallKeep.startCall(SESSION_ID, "IonCluster", "Meeting", "generic", true)
      RNCallKeep.setCurrentCallActive(SESSION_ID); 
    }



    const publishLocal = async () => {
      const local = await LocalStream.getUserMedia({
        audio: true,
        video: true,
        simulcast: false, // enable simulcast
      });
    
      client.publish(local)
      set({localStream: local})

      client.transports[1].pc.onaddstream = (e:any) => {
        console.log('on add stream: ', e.stream)
        if(e && e.stream.getVideoTracks().length > 0) set(state => ({remoteStreams: [...state.remoteStreams, e.stream]}))
      }

      client.transports[1].pc.onremovestream = (e:any) => {
        console.log('on remove stream', e.stream)
        // setStreams(streams => streams.filter(s => s.id != e.stream.id))
        set(state => ({remoteStreams: state.remoteStreams.filter(s => s.id != e.stream.id)}))
      }
    }
  },
  disconnect: () => {
    set(state => {
      if(state.client) {
        state.client.transports[1].pc.onremovestream = null
        state.client.transports[1].pc.onaddstream  = null
        state.client.close()
      }
      state.signal?.close()
      state.localStream?.getTracks().map(t => t.stop())

      RNCallKeep.endCall(SESSION_ID)

      return {
        signal: null,
        client: null,
        sessionID: '',
        connectionState: 'disconnected',
        localStream: null,
        remoteStreams: [],
      }
    })
  },
  switchCameras: () => {
    set(state => {
      state.localStream?.getVideoTracks()[0]._switchCamera()
      return {usingRearCamera: true}
    })
  },
  switchSpeaker: () => {
    set(state => {
      InCallManager.setSpeakerphoneOn(!state.usingSpeakerphone)
      return {usingSpeakerphone: !state.usingSpeakerphone}
    })
  }
}))

const IonClient = (props: ClientProps) => {
  const ionStore = useIonStore()

  console.log('streams: ', ionStore.remoteStreams)
  return (
    <View>
      <Text>state: {ionStore.connectionState}</Text>
      <View>
      
        <View style={{flexDirection:'row'}}>
          <RTCView streamURL={ionStore.localStream?.toURL()} style={styles.videoSelf} />
          <View style={styles.panel}>
            {ionStore.connectionState == 'connected' ? (
              <Button title="disconnect" onPress={ionStore.disconnect} />
            ): (
              <Button title="connect" onPress={ionStore.connect} />
            )}
            <Button title={ ionStore.usingRearCamera? "Front Camera" : "Rear Camera"} onPress={ionStore.switchCameras}/> 
            <Button title={ ionStore.usingSpeakerphone ? "Headset": "Speakerphone"  } onPress={ionStore.switchSpeaker}/>
        </View>
      </View> 
      <Text>VIDEOS:</Text>
      <ScrollView>
        <View style={styles.gridView}>
          {ionStore.remoteStreams.map(s => 
            ( 
              <Lightbox activeProps={{width: '100%', height: '100%', objectFit: 'contain'}}>
                <View style={styles.itemContainer}>
                  <RTCView objectFit='contain' streamURL={s.toURL()} style={styles.video}/>
                </View>
              </Lightbox>
            )
          )}
        </View>
      </ScrollView>
      </View>
   </View>
  )
}


declare const global: {HermesInternal: null | {}};

const App = () => {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView>
          <Text style={styles.sectionTitle}>IonCluster</Text>
          <View style={styles.body}>
            <IonClient sessionID="test-session" />
          </View>
      </SafeAreaView>
    </>
  );
};


const screenWidth = Dimensions.get("window").width;

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.lighter,
  },
  engine: {
    position: 'absolute',
    right: 0,
  },
  body: {
    backgroundColor: Colors.white,
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  videoSelf: {
    flex: 3,
    paddingRight: 8,
    paddingLeft: 8,
    borderRadius: 24,
    height: 200,
  },
  gridView: {
    marginTop: 10,
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap"
  },
  itemContainer: {
    width: screenWidth / 4,
    height: screenWidth / 4,
    padding: 8,
  },
  video: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  panel: {
    flex:2,
    paddingRight:24,
    paddingTop: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black,
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.dark,
  },
  highlight: {
    fontWeight: '700',
  },
  footer: {
    color: Colors.dark,
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    paddingRight: 12,
    textAlign: 'right',
  },
});

export default App;
