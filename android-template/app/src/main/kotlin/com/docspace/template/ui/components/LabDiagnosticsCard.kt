package com.docspace.template.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.docspace.template.R
import com.docspace.template.ui.theme.*

@Composable
fun LabDiagnosticsCard(
    modifier: Modifier = Modifier
) {
    DocSpaceCardScaffold(
        title = stringResource(R.string.title_lab_reports_portal),
        badgeText = stringResource(R.string.badge_diagnostics),
        icon = Icons.Default.Description,
        iconContentDescription = "Lab",
        gradientColors = listOf(Purple600, Color(0xFF7E22CE)),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Text(
                text = stringResource(R.string.desc_lab_reports),
                style = MaterialTheme.typography.bodyMedium,
                color = Slate600,
                lineHeight = 20.sp
            )
            Spacer(modifier = Modifier.height(12.dp))
            FilledTonalButton(
                onClick = { /* Demo trigger */ },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = Purple50,
                    contentColor = Purple700
                )
            ) {
                Text(
                    text = stringResource(R.string.btn_upload_reports),
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}
