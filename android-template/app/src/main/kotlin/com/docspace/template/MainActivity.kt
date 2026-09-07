package com.docspace.template

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.docspace.template.ui.screens.HomeScreen
import com.docspace.template.ui.theme.DocSpaceTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            DocSpaceTheme {
                HomeScreen()
            }
        }
    }
}

