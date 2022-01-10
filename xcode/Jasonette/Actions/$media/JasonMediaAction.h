//
//  JasonMediaAction.h
//  Jasonette
//
//  Copyright © 2016 gliechtenstein. All rights reserved.
//
#import "JasonAction.h"
#import "JasonHelper.h"
#import "NSGIF.h"
#import <AVFoundation/AVFoundation.h>
#import "JasonPortraitPicker.h"
#import "JasonZipPicker.h"
#import <AVKit/AVKit.h>
// @interface JasonMediaAction : JasonAction <UINavigationControllerDelegate, UIImagePickerControllerDelegate>
@interface JasonMediaAction : JasonAction <UINavigationControllerDelegate, UIImagePickerControllerDelegate, UIDocumentPickerDelegate>
@end
