import React, { useState, useCallback, PropsWithChildren } from 'react';
import {
  View,
  LayoutChangeEvent,
  ViewProps,
  LayoutRectangle,
} from 'react-native';
import { RNFFmpeg } from 'react-native-ffmpeg';
import RecordScreen, {
  RecordingStartResponse,
  RecordingResponse,
} from 'react-native-record-screen';
import { changeExtension, createNewFilePath, calcCropLayout } from './util';

interface Props extends ViewProps {}

type StartRecording = () => Promise<RecordingStartResponse>;
type StopRecording = () => Promise<RecordingResponse>;
type TakeFrame = () => Promise<RecordingResponse>;
type CleanRecord = () => void;

const useComponentLayout = () => {
  const [layout, setLayout] = useState<LayoutRectangle>({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  });

  const onLayout = useCallback(
    (event: LayoutChangeEvent, x?: number, y?: number) => {
      const size = event.nativeEvent.layout;
      if (typeof x !== 'undefined') size.x = x;
      if (typeof y !== 'undefined') size.y = y;
      setLayout((l) => Object.assign(l, size));
    },
    []
  );

  return { layout, onLayout };
};

export const useRecordScreenZone = () => {
  const { layout, onLayout } = useComponentLayout();

  const startRecording: StartRecording = () => {
    return new Promise(async (resolve, reject) => {
      const res = await RecordScreen.startRecording({ mic: false }).catch(
        reject
      );
      if (res) {
        resolve(res);
      }
    });
  };

  const stopRecording: StopRecording = () => {
    return new Promise(async (resolve, reject) => {
      const res = await RecordScreen.stopRecording().catch(reject);
      if (res) {
        const newPath = createNewFilePath(res.result.outputURL);
        const { width, height, x, y } = calcCropLayout(layout);
        RNFFmpeg.executeWithArguments([
          '-i',
          res.result.outputURL,
          '-vf',
          `crop=w=${width}:h=${height}:x=${x}:y=${y}`,
          '-c:v',
          'libx264',
          newPath,
        ]).then(() => {
          res.result.outputURL = newPath;
          resolve(res);
        });
      }
    });
  };

  const takeFrame: TakeFrame = () => {
    return new Promise(async (resolve, reject) => {
      const rec = await startRecording().catch(reject);
      if (rec) {
        setTimeout(() => {
          stopRecording()
            .then((res) => {
              const photoName = changeExtension(res.result.outputURL, 'jpg');
              const command = `-sseof -1 -i ${res.result.outputURL} -vsync 0 -q:v 1 -update true ${photoName}`;
              RNFFmpeg.execute(command).then(() => {
                res.result.outputURL = photoName;
                resolve(res);
              });
            })
            .catch(reject);
        }, 1000);
      }
    });
  };

  const cleanRecord: CleanRecord = () => {
    RecordScreen.clean();
  };

  const Wrapper: React.FC<Props> = (
    props: PropsWithChildren<Props> & { x?: number; y?: number }
  ) => {
    return (
      <View {...props} onLayout={(event) => onLayout(event, props.x, props.y)}>
        {props.children}
      </View>
    );
  };

  return {
    startRecording,
    stopRecording,
    takeFrame,
    cleanRecord,
    RecordScreenZone: Wrapper,
  };
};
